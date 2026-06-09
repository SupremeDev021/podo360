export type Role = "super_admin" | "company_admin" | "professional" | "reception" | "financial";

export type PlanStatus = "trial" | "active" | "past_due" | "blocked" | "cancelled";

export type AppointmentStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";

export type PaymentStatus = "paid" | "pending" | "overdue" | "cancelled";

export type PaymentMethod = "pix" | "cash" | "credit_card" | "debit_card" | "insurance" | "other";

export type BodySide = "right" | "left" | "bilateral" | "not_applicable";

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
  professionalId: string;
  scheduledAt: string;
  type: string;
  procedure: string;
  complaint: string;
  clinicalEvaluation: string;
  conduct: string;
  productsUsed: string[];
  notes: string;
  recommendedReturn?: string;
  status: AppointmentStatus;
  value: number;
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
  content: string;
  status: "draft" | "saved" | "exported";
  createdAt: string;
};
