export type Role = "super_admin" | "company_admin" | "professional" | "reception" | "financial";

export type PlanStatus = "trial" | "active" | "past_due" | "blocked" | "cancelled";

export type AppointmentStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";

export type PaymentStatus = "paid" | "pending" | "overdue" | "cancelled";

export type PaymentMethod = "pix" | "cash" | "credit_card" | "debit_card" | "insurance" | "other";

export type BodySide = "right" | "left" | "bilateral" | "not_applicable";

export type AttendanceStatus =
  | "ba_open"
  | "waiting"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled"
  | "no_show";

export type FootSide = "right" | "left";

export type SensitivityStatus = "present" | "reduced" | "absent" | "not_tested";

export type AnamnesisStepStatus = "not_started" | "in_progress" | "partially_filled" | "completed" | "skipped";

export type ConsentStatus = "authorized" | "unauthorized" | "revoked" | "pending";

export type HciAccessScope =
  | "clinical_summary"
  | "full_history"
  | "history_with_images"
  | "history_without_images"
  | "medical_reports_only"
  | "recent_attendances";

export type Company = {
  id: string;
  name: string;
  displayName: string;
  logoUrl?: string;
  contactEmail: string;
  contactPhone: string;
  document: string;
  planName: string;
  planStatus: PlanStatus;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  hciEnabled?: boolean;
  hciConsentValidityDays?: number;
  hciAllowImages?: boolean;
  hciDefaultScope?: HciAccessScope;
};

export type Profile = {
  id: string;
  companyId: string | null;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
};

export type Patient = {
  id: string;
  companyId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  email?: string;
  address: string;
  profession?: string;
  notes?: string;
  createdAt: string;
  clinical: PatientClinicalData;
};

export type UniqueMedicalRecord = {
  id: string;
  uniqueRecordNumber: string;
  patientUniqueId: string;
  cpfHash?: string;
  normalizedPatientName: string;
  birthDate?: string;
  phoneHash?: string;
  emailHash?: string;
  createdAt: string;
  updatedAt?: string;
};

export type PatientCompanyLink = {
  id: string;
  uniqueMedicalRecordId: string;
  patientId: string;
  companyId: string;
  localPatientId: string;
  firstAttendanceDate?: string;
  lastAttendanceDate?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt?: string;
};

export type PatientClinicalData = {
  chiefComplaint: string;
  diseaseHistory: string;
  diabetes: boolean;
  hypertension: boolean;
  medications: string;
  allergies: string;
  previousSurgeries: string;
  vascularProblems: string;
  dermatologicalProblems: string;
  clinicalNotes: string;
};

export type Attendance = {
  id: string;
  companyId: string;
  patientId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  professionalId?: string;
  appointmentId?: string;
  openedAt: string;
  startedAt?: string;
  finishedAt?: string;
  openedBy?: string;
  startedBy?: string;
  finishedBy?: string;
  scheduledAt: string;
  attendanceDate?: string;
  type: string;
  visitKind?: "first_evaluation" | "return";
  initialNotes?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  procedure: string;
  complaint: string;
  clinicalEvaluation: string;
  conduct: string;
  productsUsed: string[];
  notes: string;
  recommendedReturn?: string;
  status: AttendanceStatus;
  value: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AnamnesisFormData = Record<string, string | number | boolean | string[] | Record<string, unknown> | null | undefined>;

export type AnamnesisRecord = {
  id: string;
  companyId: string;
  patientId: string;
  uniqueMedicalRecordId: string;
  attendanceId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  formData: AnamnesisFormData;
  currentStep: number;
  stepStatuses: Record<string, AnamnesisStepStatus>;
  isCompleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
};

export type FootSensitivityMap = {
  id: string;
  companyId: string;
  patientId: string;
  uniqueMedicalRecordId: string;
  attendanceId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  footSide: FootSide;
  regionKey: string;
  pointKey: string;
  coordinates: { x: number; y: number; z?: number };
  sensitivityStatus: SensitivityStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
};

export type AttendanceImage = {
  id: string;
  companyId: string;
  patientId: string;
  uniqueMedicalRecordId: string;
  attendanceId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  imageType: "before" | "during" | "after";
  fileUrl: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
};

export type FinancialTransaction = {
  id: string;
  companyId: string;
  patientId?: string;
  attendanceId?: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  dueDate: string;
  paidAt?: string;
  paymentMethod: PaymentMethod;
  category: string;
  status: PaymentStatus;
};

export type StockProduct = {
  id: string;
  companyId: string;
  name: string;
  category: string;
  internalCode: string;
  currentQuantity: number;
  minimumQuantity: number;
  unit: string;
  costValue: number;
  saleValue: number;
  supplier: string;
  expiresAt?: string;
};

export type BodyMapEntry = {
  id: string;
  companyId: string;
  patientId: string;
  attendanceId?: string;
  bodyRegion: string;
  bodySide: BodySide;
  regionKey: string;
  coordinates?: { x: number; y: number; z?: number };
  dressingType: string;
  woundDescription: string;
  procedureDescription: string;
  productsUsed: string[];
  notes: string;
  images: string[];
  createdBy: string;
  createdAt: string;
};

export type AiReferralReport = {
  id: string;
  companyId: string;
  patientId: string;
  attendanceId?: string;
  uniqueMedicalRecordId?: string;
  uniqueRecordNumber?: string;
  baNumbersAnalyzed?: string[];
  content: string;
  editedText?: string;
  includeHci?: boolean;
  status: "draft" | "saved" | "exported";
  createdAt: string;
};

export type HciPatientMatch = {
  id: string;
  patientId: string;
  companyId: string;
  companyName: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  patientName: string;
  birthDate?: string;
  matchPriority: string;
  consentStatus: ConsentStatus;
  accessScope?: HciAccessScope;
};

export type HciPatientConsent = {
  id: string;
  uniqueMedicalRecordId: string;
  patientId: string;
  patientCpf: string;
  requesterCompanyId: string;
  sourceCompanyId: string;
  consentStatus: ConsentStatus;
  accessScope: HciAccessScope;
  authorizedBy?: string;
  requestedBy: string;
  requestedAt: string;
  authorizedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  notes?: string;
};

export type IntegratedClinicalHistory = {
  patient: Patient;
  sourceCompany: Company;
  attendances: Attendance[];
  anamneses: AnamnesisRecord[];
  footSensitivityMaps: FootSensitivityMap[];
  reports: AiReferralReport[];
  images: AttendanceImage[];
};
