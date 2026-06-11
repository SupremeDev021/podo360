import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AiReferralReport, AnamnesisRecord, Attendance, AttendanceImage, BodyMapEntry, FinancialTransaction, FootSensitivityMap, Patient, StockProduct } from "../types";

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
      unique_medical_record_id: patient.uniqueMedicalRecordId,
      unique_record_number: patient.uniqueRecordNumber,
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

export async function saveAnamnesisRecord(record: AnamnesisRecord) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("anamnesis_records")
    .upsert({
      id: record.id,
      company_id: record.companyId,
      patient_id: record.patientId,
      unique_medical_record_id: record.uniqueMedicalRecordId,
      attendance_id: record.attendanceId,
      unique_record_number: record.uniqueRecordNumber,
      ba_number: record.baNumber,
      form_data: record.formData,
      current_step: record.currentStep,
      step_statuses: record.stepStatuses,
      is_completed: record.isCompleted,
      created_by: record.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveFootSensitivityMap(entry: Omit<FootSensitivityMap, "id" | "createdAt">) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("foot_sensitivity_maps")
    .insert({
      company_id: entry.companyId,
      patient_id: entry.patientId,
      unique_medical_record_id: entry.uniqueMedicalRecordId,
      attendance_id: entry.attendanceId,
      unique_record_number: entry.uniqueRecordNumber,
      ba_number: entry.baNumber,
      foot_side: entry.footSide,
      region_key: entry.regionKey,
      point_key: entry.pointKey,
      coordinates: entry.coordinates,
      sensitivity_status: entry.sensitivityStatus,
      notes: entry.notes,
      created_by: entry.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveAttendanceImage(image: Omit<AttendanceImage, "id" | "createdAt">) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("attendance_images")
    .insert({
      company_id: image.companyId,
      patient_id: image.patientId,
      unique_medical_record_id: image.uniqueMedicalRecordId,
      attendance_id: image.attendanceId,
      unique_record_number: image.uniqueRecordNumber,
      ba_number: image.baNumber,
      image_type: image.imageType,
      foot_side: image.footSide,
      foot_region: image.footRegion,
      file_url: image.fileUrl,
      description: image.description,
      clinical_notes: image.clinicalNotes,
      comparative_notes: image.comparativeNotes,
      notes: image.notes,
      created_by: image.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAttendanceBa(attendance: Attendance) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("attendances")
    .insert({
      company_id: attendance.companyId,
      appointment_id: attendance.appointmentId,
      converted_from_appointment: attendance.convertedFromAppointment,
      patient_id: attendance.patientId,
      unique_medical_record_id: attendance.uniqueMedicalRecordId,
      unique_record_number: attendance.uniqueRecordNumber,
      ba_number: attendance.baNumber,
      status: attendance.status,
      opened_at: attendance.openedAt,
      opened_by: attendance.openedBy,
      professional_id: attendance.professionalId,
      attendance_date: attendance.attendanceDate,
      type: attendance.type,
      visit_kind: attendance.visitKind,
      initial_notes: attendance.initialNotes,
      priority: attendance.priority,
      patient_complaint: attendance.complaint,
      procedure_performed: attendance.procedure,
      clinical_evaluation: attendance.clinicalEvaluation,
      conduct_performed: attendance.conduct,
      products_used: attendance.productsUsed,
      notes: attendance.notes,
      amount: attendance.value
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function startAttendanceBa(attendanceId: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc("mark_attendance_started", { target_attendance_id: attendanceId });
  if (error) throw error;
  return data;
}

export async function finishAttendanceBa(attendanceId: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc("mark_attendance_finished", { target_attendance_id: attendanceId });
  if (error) throw error;
  return data;
}

export async function createStockProduct(product: StockProduct) {
  if (!isSupabaseConfigured || !supabase) return null;

  const basePayload = {
    company_id: product.companyId,
    name: product.name,
    category: product.category,
    internal_code: product.internalCode,
    current_quantity: product.currentQuantity,
    minimum_quantity: product.minimumQuantity,
    unit: product.unit,
    cost_value: product.costValue,
    sale_value: product.saleValue,
    supplier: product.supplier,
    expires_at: product.expiresAt || null
  };
  let { data, error } = await supabase.from("stock_products").insert({ ...basePayload, notes: product.notes || null }).select().single();

  if (error && ["42703", "PGRST204"].includes(error.code)) {
    ({ data, error } = await supabase.from("stock_products").insert(basePayload).select().single());
  }

  if (error) throw error;
  return data;
}

export async function createFinancialTransaction(transaction: FinancialTransaction, createdBy: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const basePayload = {
    company_id: transaction.companyId,
    patient_id: transaction.patientId || null,
    attendance_id: transaction.attendanceId || null,
    description: transaction.description,
    type: transaction.type,
    amount: transaction.amount,
    due_date: transaction.dueDate,
    paid_at: transaction.paidAt || null,
    payment_method: transaction.paymentMethod,
    category: transaction.category,
    status: transaction.status,
    created_by: createdBy
  };
  let { data, error } = await supabase.from("financial_transactions").insert({ ...basePayload, notes: transaction.notes || null }).select().single();

  if (error && ["42703", "PGRST204"].includes(error.code)) {
    ({ data, error } = await supabase.from("financial_transactions").insert(basePayload).select().single());
  }

  if (error) throw error;
  return data;
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
      unique_medical_record_id: report.uniqueMedicalRecordId,
      unique_record_number: report.uniqueRecordNumber,
      ba_numbers_analyzed: report.baNumbersAnalyzed,
      generated_text: report.content,
      edited_text: report.editedText,
      include_hci: report.includeHci,
      content: report.content,
      status: report.status,
      created_by: report.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
