import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AiReferralReport, AnamnesisRecord, Attendance, AttendanceImage, AutoclaveRecord, BodyMapEntry, ClinicalAppointment, Company, FinancialTransaction, FootSensitivityMap, Patient, StockProduct, UsedProduct } from "../types";

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

export async function saveCompanySettings(company: Company) {
  if (!isSupabaseConfigured || !supabase) return null;

  const payload = {
    company_id: company.id,
    display_name: company.displayName,
    logo_url: company.logoUrl || null,
    logo_path: company.logoPath || null,
    logo_uploaded_at: company.logoUploadedAt || null,
    primary_color: company.primaryColor,
    secondary_color: company.secondaryColor,
    accent_color: company.accentColor,
    background_color: company.backgroundColor || null,
    sidebar_color: company.sidebarColor || null,
    sidebar_text_color: company.sidebarTextColor || null,
    sidebar_hover_color: company.sidebarHoverColor || null,
    commercial_data: {
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      document: company.document
    },
    hci_enabled: company.hciEnabled ?? false,
    hci_consent_validity_days: company.hciConsentValidityDays ?? 180,
    hci_allow_images: company.hciAllowImages ?? false,
    hci_default_scope: company.hciDefaultScope ?? "history_without_images",
    auto_financial_on_finish: company.autoFinancialOnFinish ?? false,
    require_financial_confirmation: company.requireFinancialConfirmation ?? true,
    include_products_in_financial: company.includeProductsInFinancial ?? true,
    include_procedures_in_financial: company.includeProceduresInFinancial ?? true
  };

  const { data, error } = await supabase
    .from("company_settings")
    .upsert(payload, { onConflict: "company_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadCompanyLogo(companyId: string, file: File) {
  if (!isSupabaseConfigured || !supabase) return null;

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "logo";
  const path = `${companyId}/logo/${Date.now()}-${safeName}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("company-assets").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("company-assets").getPublicUrl(path);

  return {
    path,
    url: data.publicUrl,
    uploadedAt: new Date().toISOString()
  };
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

export async function saveAttendanceUsedProducts(record: AnamnesisRecord, products: UsedProduct[]) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { error: deleteError } = await supabase.from("attendance_used_products").delete().eq("company_id", record.companyId).eq("anamnesis_record_id", record.id);
  if (deleteError) throw deleteError;
  if (!products.length) return [];
  const { data, error } = await supabase.from("attendance_used_products").insert(products.map((product) => ({
    company_id: record.companyId,
    patient_id: record.patientId,
    unique_medical_record_id: record.uniqueMedicalRecordId,
    attendance_id: record.attendanceId,
    anamnesis_record_id: record.id,
    ba_number: record.baNumber,
    product_id: product.productId?.startsWith("catalog-") || product.productId?.startsWith("stock-") ? null : product.productId || null,
    product_name: product.name.trim(),
    category_name: product.category || null,
    quantity: product.quantity,
    unit: product.unit,
    unit_price: product.unitPrice || 0,
    total_price: product.quantity * (product.unitPrice || 0),
    notes: product.notes || null,
    created_by: record.createdBy
  }))).select();
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
      payer_type: attendance.payerType || "private",
      insurance_name: attendance.insuranceName || null,
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

export async function updateClinicalAppointment(appointment: ClinicalAppointment) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("appointments")
    .update({
      appointment_date: appointment.appointmentDate,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      professional_id: appointment.professionalId || null,
      notes: appointment.notes || null,
      status: appointment.status,
      marked_absent_at: appointment.markedAbsentAt || null,
      marked_absent_by: appointment.markedAbsentBy || null,
      absence_notes: appointment.absenceNotes || null
      , payer_type: appointment.payerType || "private"
      , insurance_name: appointment.insuranceName || null
    })
    .eq("id", appointment.id)
    .eq("company_id", appointment.companyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClinicalAppointment(appointment: Omit<ClinicalAppointment, "id">) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("appointments").insert({
    company_id: appointment.companyId,
    patient_id: appointment.patientId || null,
    unique_medical_record_id: appointment.uniqueMedicalRecordId || null,
    temporary_patient_name: appointment.temporaryPatientName || null,
    temporary_patient_phone: appointment.temporaryPatientPhone || null,
    temporary_patient_whatsapp: appointment.temporaryPatientWhatsapp || null,
    temporary_patient_email: appointment.temporaryPatientEmail || null,
    temporary_patient_birth_date: appointment.temporaryPatientBirthDate || null,
    appointment_date: appointment.appointmentDate,
    start_time: appointment.startTime,
    end_time: appointment.endTime,
    professional_id: appointment.professionalId || null,
    procedure_type: appointment.procedureType,
    appointment_type: appointment.appointmentType,
    initial_complaint: appointment.initialComplaint,
    notes: appointment.notes || null,
    status: appointment.status,
    payer_type: appointment.payerType || "private",
    insurance_name: appointment.insuranceName || null,
    created_by: appointment.createdBy
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateStockProduct(product: StockProduct) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("stock_products").update({
    name: product.name,
    category: product.category,
    unit: product.unit,
    supplier: product.supplier || null,
    cost_value: product.costValue,
    sale_value: product.saleValue,
    notes: product.notes || null,
    active: product.active ?? true,
    deleted_at: product.deletedAt || null,
    deleted_by: product.deletedBy || null
  }).eq("id", product.id).eq("company_id", product.companyId).select().single();
  if (error) throw error;
  return data;
}

export async function manageCompanyUser(input: { action: "update" | "reset_password" | "deactivate" | "reactivate"; userId: string; companyId: string; fullName?: string; role?: string; active?: boolean; modules?: string[] }) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.functions.invoke("admin-create-company-user", { body: input });
  if (error) throw error;
  return data;
}

export async function createCompanyUser(input: { companyId: string; fullName: string; email: string; role: string; active: boolean; modules: string[]; temporaryPassword?: string; requirePasswordChange?: boolean; sendInviteEmail?: boolean }) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.functions.invoke("admin-create-company-user", { body: input });
  if (error) throw error;
  return data;
}

export async function resetOwnPassword(email: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
  return data;
}

export async function updateOwnPassword(newPassword: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
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
    expires_at: product.expiresAt || null,
    active: product.active ?? true
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
    ba_number: transaction.baNumber || null,
    unique_medical_record_id: transaction.uniqueMedicalRecordId || null,
    description: transaction.description,
    type: transaction.type,
    amount: transaction.amount,
    due_date: transaction.dueDate,
    paid_at: transaction.paidAt || null,
    payment_method: transaction.paymentMethod,
    category: transaction.category,
    status: transaction.status,
    created_by: createdBy,
    payer_type: transaction.payerType || "private",
    insurance_name: transaction.insuranceName || null
  };
  let { data, error } = await supabase.from("financial_transactions").insert({ ...basePayload, notes: transaction.notes || null }).select().single();

  if (error && ["42703", "PGRST204"].includes(error.code)) {
    ({ data, error } = await supabase.from("financial_transactions").insert(basePayload).select().single());
  }

  if (error) throw error;
  return data;
}

function autoclavePayload(record: AutoclaveRecord) {
  return {
    company_id: record.companyId,
    cycle_date: record.cycleDate,
    start_time: record.startTime,
    end_time: record.endTime,
    cycle_number: record.cycleNumber,
    sterilization_lot: record.sterilizationLot,
    responsible_user_id: record.responsibleUserId || null,
    responsible_name: record.responsibleName,
    autoclave_product_id: record.autoclaveProductId || null,
    autoclave_name: record.autoclaveName,
    autoclave_code: record.autoclaveCode,
    temperature: record.temperature,
    pressure: record.pressure,
    exposure_time: record.exposureTime,
    cycle_type: record.cycleType,
    chemical_indicator_result: record.chemicalIndicatorResult,
    biological_indicator_result: record.biologicalIndicatorResult,
    integrator_result: record.integratorResult,
    bowie_dick_result: record.bowieDickResult,
    final_result: record.finalResult,
    status: record.status,
    notes: record.notes || null,
    incidents: record.incidents || null,
    corrective_action: record.correctiveAction || null,
    attachment_url: record.attachmentUrl || null,
    attachment_path: record.attachmentPath || null,
    created_by: record.createdBy || null,
    updated_by: record.updatedBy || null,
    deleted_at: record.deletedAt || null
  };
}

async function replaceAutoclaveItems(record: AutoclaveRecord) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { error: deleteError } = await supabase.from("autoclave_record_items").delete().eq("company_id", record.companyId).eq("autoclave_record_id", record.id);
  if (deleteError) throw deleteError;
  if (!record.items.length) return [];
  const { data, error } = await supabase.from("autoclave_record_items").insert(record.items.map((item) => ({
    company_id: record.companyId,
    autoclave_record_id: record.id,
    stock_product_id: item.stockProductId || null,
    stock_product_code: item.stockProductCode || null,
    material_name: item.materialName,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes || null
  }))).select();
  if (error) throw error;
  return data;
}

export async function createAutoclaveRecord(record: AutoclaveRecord) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("autoclave_records").insert({ id: record.id, ...autoclavePayload(record) }).select().single();
  if (error) throw error;
  await replaceAutoclaveItems(record);
  return data;
}

export async function updateAutoclaveRecord(record: AutoclaveRecord) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("autoclave_records").update(autoclavePayload(record)).eq("id", record.id).eq("company_id", record.companyId).select().single();
  if (error) throw error;
  await replaceAutoclaveItems(record);
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
